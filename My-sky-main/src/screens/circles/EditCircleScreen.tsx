import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList, ProfileStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { getCurrentLocation } from '../../utils/locationUtils';
import { Circle } from '../../models/Circle';

type EditCircleRouteProp = RouteProp<DiscoverStackParamList | ProfileStackParamList, 'EditCircle'>;
type EditCircleNavigationProp = CompositeNavigationProp<
  StackNavigationProp<DiscoverStackParamList, 'EditCircle'>,
  StackNavigationProp<ProfileStackParamList>
>;

const DEFAULT_ICON = 'https://via.placeholder.com/150';
const DEFAULT_COVER = 'https://via.placeholder.com/800x200';

// カテゴリーリスト
const CATEGORIES = [
  { id: 'art', name: 'アート、クリエイティブ系' },
  { id: 'music', name: '音楽' },
  { id: 'sports', name: 'スポーツ、アウトドア' },
  { id: 'game', name: 'ゲーム、エンタメ系' },
  { id: 'food', name: '料理、グルメ' },
  { id: 'science', name: '科学、サイエンス' },
  { id: 'fashion', name: 'ファッション、美容' },
  { id: 'vehicle', name: '乗り物、コレクション' },
  { id: 'literature', name: '文学、言語' },
  { id: 'animal', name: 'ペット、動物' },
  { id: 'social', name: '社会、文化' },
  { id: 'business', name: '起業、イベント' },
];

// 都道府県リスト
const prefectures = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

interface ImageUpload {
  uri: string;
  fileName: string | undefined;
  type: string | undefined;
}

const EditCircleScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<EditCircleNavigationProp>();
  const route = useRoute<EditCircleRouteProp>();
  const { circleId } = route.params;
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [iconImage, setIconImage] = useState<ImageUpload | null>(null);
  const [coverImage, setCoverImage] = useState<ImageUpload | null>(null);
  const [activityArea, setActivityArea] = useState('');
  const [icon, setIcon] = useState('');
  const [coverPhoto, setCoverPhoto] = useState('');
  
  // 都道府県選択モーダル
  const [showPrefectureModal, setShowPrefectureModal] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [circle, setCircle] = useState<Circle | null>(null);
  
  // サークル情報を取得
  useEffect(() => {
    const fetchCircleData = async () => {
      try {
        const circleDoc = await firestore().collection('circles').doc(circleId).get();
        
        if (!circleDoc.exists) {
          Alert.alert('エラー', 'サークルが見つかりませんでした');
          navigation.goBack();
          return;
        }
        
        const circleData = { id: circleDoc.id, ...circleDoc.data() } as Circle;
        setCircle(circleData);
        
        // 各フィールドに値をセット
        setName(circleData.name || '');
        setDescription(circleData.description || '');
        setRules(circleData.rules || '');
        setSelectedCategories(circleData.categories || []);
        setIsPrivate(circleData.isPrivate || false);
        
        // Firestoreから取得したデータに活動エリアがあれば設定
        const circleDataAny = circleData as any;
        if (circleDataAny.activityArea) {
          setActivityArea(circleDataAny.activityArea);
        }
        
        if (circleData.location) {
          setLocation(circleData.location);
          setUseCurrentLocation(false);
        } else {
          setUseCurrentLocation(true);
        }
        
        if (circleData.icon) {
          setIcon(circleData.icon);
        }
        
        if (circleData.coverPhoto) {
          setCoverPhoto(circleData.coverPhoto);
        }
        
        setInitialLoading(false);
      } catch (error) {
        console.error('Error fetching circle data:', error);
        Alert.alert('エラー', 'サークル情報の取得に失敗しました');
        navigation.goBack();
      }
    };
    
    fetchCircleData();
  }, [circleId, navigation]);
  
  // 現在位置を取得
  const fetchCurrentLocation = async () => {
    try {
      const coords = await getCurrentLocation();
      setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('位置情報エラー', '現在位置を取得できませんでした。手動で活動エリアを設定してください。');
      setUseCurrentLocation(false);
    }
  };
  
  // 画像選択（アイコン）
  const selectIconImage = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 500,
        maxHeight: 500,
      },
      (response) => {
        if (response.didCancel) {
          return;
        }
        
        if (response.errorCode) {
          Alert.alert('エラー', '画像の選択中にエラーが発生しました');
          return;
        }
        
        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          setIconImage({
            uri: asset.uri || '',
            fileName: asset.fileName,
            type: asset.type,
          });
        }
      }
    );
  };
  
  // 画像選択（カバー）
  const selectCoverImage = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 600,
      },
      (response) => {
        if (response.didCancel) {
          return;
        }
        
        if (response.errorCode) {
          Alert.alert('エラー', '画像の選択中にエラーが発生しました');
          return;
        }
        
        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          setCoverImage({
            uri: asset.uri || '',
            fileName: asset.fileName,
            type: asset.type,
          });
        }
      }
    );
  };
  
  // カテゴリー選択の切り替え
  const toggleCategory = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
    } else {
      if (selectedCategories.length < 3) {
        setSelectedCategories([...selectedCategories, categoryId]);
      } else {
        Alert.alert('カテゴリー制限', 'カテゴリーは最大3つまで選択できます');
      }
    }
  };
  
  // 入力検証
  const validateInputs = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'サークル名を入力してください';
    }
    
    if (!description.trim()) {
      newErrors.description = '説明を入力してください';
    }
    
    if (selectedCategories.length === 0) {
      newErrors.categories = 'カテゴリーを選択してください';
    }
    
    if (!activityArea.trim() && !useCurrentLocation) {
      newErrors.activityArea = '活動エリアを入力してください';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // サークル更新処理
  const updateCircle = async () => {
    if (!validateInputs()) {
      return;
    }
    
    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }
    
    setLoading(true);
    
    try {
      let updatedIcon = icon;
      let updatedCoverPhoto = coverPhoto;
      
      // アイコン画像のアップロード
      if (iconImage) {
        const iconRef = storage().ref(`circles/${circleId}/icon_${Date.now()}`);
        if (iconImage.uri) {
          await iconRef.putFile(iconImage.uri);
          updatedIcon = await iconRef.getDownloadURL();
        }
      }
      
      // カバー画像のアップロード
      if (coverImage) {
        const coverRef = storage().ref(`circles/${circleId}/cover_${Date.now()}`);
        if (coverImage.uri) {
          await coverRef.putFile(coverImage.uri);
          updatedCoverPhoto = await coverRef.getDownloadURL();
        }
      }
      
      // サークルデータの更新
      const circleData = {
        name,
        description,
        rules,
        categories: selectedCategories,
        isPrivate,
        location: useCurrentLocation ? location : null,
        activityArea: activityArea.trim(),
        icon: updatedIcon || DEFAULT_ICON,
        coverPhoto: updatedCoverPhoto || DEFAULT_COVER,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      
      await firestore().collection('circles').doc(circleId).update(circleData);
      
      Alert.alert('成功', 'サークル情報を更新しました', [
        { text: 'OK', onPress: () => navigation.navigate('CircleDetails', { circleId }) }
      ]);
    } catch (error) {
      console.error('Error updating circle:', error);
      Alert.alert('エラー', 'サークルの更新に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };
  
  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>サークル情報を読み込み中...</Text>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>基本情報</Text>
          
          {/* サークル名 */}
          <Text style={styles.label}>サークル名 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            value={name}
            onChangeText={setName}
            placeholder="サークル名を入力"
            placeholderTextColor={theme.colors.text.secondary}
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          
          {/* 説明 */}
          <Text style={styles.label}>説明 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea, errors.description ? styles.inputError : null]}
            value={description}
            onChangeText={setDescription}
            placeholder="サークルの説明を入力"
            placeholderTextColor={theme.colors.text.secondary}
            multiline
            numberOfLines={4}
          />
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
          
          {/* ルール */}
          <Text style={styles.label}>ルール</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={rules}
            onChangeText={setRules}
            placeholder="サークルのルールを入力（任意）"
            placeholderTextColor={theme.colors.text.secondary}
            multiline
            numberOfLines={4}
          />
          
          {/* カテゴリー */}
          <Text style={styles.label}>カテゴリー <Text style={styles.required}>*</Text> (最大3つ)</Text>
          {errors.categories ? <Text style={styles.errorText}>{errors.categories}</Text> : null}
          
          <View style={styles.categoriesContainer}>
            {CATEGORIES.map(category => (
              <TouchableOpacity
                key={`category-${category.id}`}
                style={[
                  styles.categoryItem,
                  selectedCategories.includes(category.id) ? styles.categorySelected : null
                ]}
                onPress={() => toggleCategory(category.id)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategories.includes(category.id) ? styles.categoryTextSelected : null
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* プライベート設定 */}
          <View style={styles.switchContainer}>
            <Text style={styles.label}>プライベートサークル</Text>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: '#767577', true: theme.colors.primary }}
              thumbColor={isPrivate ? theme.colors.secondary : '#f4f3f4'}
            />
          </View>
          <Text style={styles.helperText}>
            プライベートサークルは招待されたユーザーのみが参加できます
          </Text>
          
          {/* 活動エリア */}
          <Text style={styles.sectionTitle}>活動エリア</Text>
          
          {/* 現在地を使用 */}
          <View style={styles.switchContainer}>
            <Text style={styles.label}>現在地を使用</Text>
            <Switch
              value={useCurrentLocation}
              onValueChange={(value) => {
                setUseCurrentLocation(value);
                if (value) {
                  fetchCurrentLocation();
                }
              }}
              trackColor={{ false: '#767577', true: theme.colors.primary }}
              thumbColor={useCurrentLocation ? theme.colors.secondary : '#f4f3f4'}
            />
          </View>
          
          {!useCurrentLocation && (
            <>
              <Text style={styles.label}>活動エリア <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={[styles.input, errors.activityArea ? styles.inputError : null]}
                onPress={() => setShowPrefectureModal(true)}
              >
                <Text style={activityArea ? styles.inputText : styles.placeholderText}>
                  {activityArea || '都道府県を選択'}
                </Text>
              </TouchableOpacity>
              {errors.activityArea ? <Text style={styles.errorText}>{errors.activityArea}</Text> : null}
            </>
          )}
          
          {/* 画像アップロード */}
          <Text style={styles.sectionTitle}>画像</Text>
          
          {/* アイコン */}
          <Text style={styles.label}>アイコン</Text>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: iconImage?.uri || icon || DEFAULT_ICON }}
              style={styles.iconPreview}
            />
            <TouchableOpacity style={styles.uploadButton} onPress={selectIconImage}>
              <Icon name="image-outline" size={24} color="#fff" />
              <Text style={styles.uploadButtonText}>画像を選択</Text>
            </TouchableOpacity>
          </View>
          
          {/* カバー */}
          <Text style={styles.label}>カバー画像</Text>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: coverImage?.uri || coverPhoto || DEFAULT_COVER }}
              style={styles.coverPreview}
            />
            <TouchableOpacity style={styles.uploadButton} onPress={selectCoverImage}>
              <Icon name="image-outline" size={24} color="#fff" />
              <Text style={styles.uploadButtonText}>画像を選択</Text>
            </TouchableOpacity>
          </View>
          
          {/* 更新ボタン */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.disabledButton]}
            onPress={updateCircle}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? '更新中...' : 'サークルを更新'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* 都道府県選択モーダル */}
      <Modal
        visible={showPrefectureModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>都道府県を選択</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPrefectureModal(false)}
              >
                <Icon name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={prefectures}
              keyExtractor={(item) => `prefecture-${item}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.prefectureItem}
                  onPress={() => {
                    setActivityArea(item);
                    setShowPrefectureModal(false);
                  }}
                >
                  <Text style={styles.prefectureText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  formContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  required: {
    color: theme.colors.error,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  inputText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  placeholderText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  inputError: {
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginBottom: 8,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  helperText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 12,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryItem: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  categorySelected: {
    backgroundColor: theme.colors.primary,
  },
  categoryText: {
    color: theme.colors.text.primary,
    fontSize: 14,
  },
  categoryTextSelected: {
    color: '#fff',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  coverPreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  uploadButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  prefectureItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  prefectureText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
});

export default EditCircleScreen;
