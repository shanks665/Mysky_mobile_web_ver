import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform, Switch, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp, CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList, ProfileStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { getCurrentLocation } from '../../utils/locationUtils';
import PrefectureSelector from '../../components/PrefectureSelector';
import { getLocationString } from '../../utils/prefectureData';

type EditEventRouteProp = RouteProp<DiscoverStackParamList | ProfileStackParamList, 'EditEvent'>;
type EditEventNavigationProp = CompositeNavigationProp<
  StackNavigationProp<DiscoverStackParamList, 'EditEvent'>,
  StackNavigationProp<ProfileStackParamList>
>;

// ジャンルのカテゴリーリスト
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

const EditEventScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<EditEventNavigationProp>();
  const route = useRoute<EditEventRouteProp>();
  const { eventId } = route.params;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [circleId, setCircleId] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [prefectureId, setPrefectureId] = useState<string>('');
  const [cityId, setCityId] = useState<string>('');
  const [showPrefectureSelector, setShowPrefectureSelector] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // イベント情報を取得
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setIsFetching(true);
        const eventDoc = await firestore().collection('events').doc(eventId).get();
        
        if (!eventDoc.exists) {
          Alert.alert('エラー', 'イベントが見つかりませんでした');
          navigation.goBack();
          return;
        }

        const eventData = eventDoc.data();
        if (!eventData) return;

        setTitle(eventData.title || '');
        setDescription(eventData.description || '');
        setLocationName(eventData.locationName || '');

        // 日付と時間の設定
        if (eventData.startDate) {
          try {
            const eventDate = eventData.startDate.toDate 
              ? eventData.startDate.toDate() 
              : new Date(eventData.startDate);
              
            if (!isNaN(eventDate.getTime())) {
              setDate(eventDate);
              setTime(eventDate);
            } else {
              console.error('Invalid date value from Firestore:', eventData.startDate);
              setDate(new Date());
              setTime(new Date());
            }
          } catch (error) {
            console.error('Error converting date:', error);
            setDate(new Date());
            setTime(new Date());
          }
        }

        setMaxParticipants(eventData.maxParticipants ? String(eventData.maxParticipants) : '');
        setRequiresApproval(eventData.requiresApproval || false);
        
        if (eventData.location) {
          setLocation(eventData.location);
          setUseCurrentLocation(!!eventData.location);
        }
        
        setCircleId(eventData.circleId || '');
        
        // カテゴリとプレフェクチャーの設定
        if (eventData.categories && Array.isArray(eventData.categories)) {
          setSelectedCategories(eventData.categories);
        }
        
        if (eventData.prefecture) {
          setPrefectureId(eventData.prefecture);
        }
        
        if (eventData.city) {
          setCityId(eventData.city);
        }
      } catch (error) {
        console.error('Error fetching event data:', error);
        Alert.alert('エラー', 'イベント情報の取得に失敗しました');
      } finally {
        setIsFetching(false);
      }
    };

    fetchEventData();
  }, [eventId, navigation]);

  // 位置情報が有効な場合、現在地を取得
  useEffect(() => {
    if (useCurrentLocation && !location) {
      fetchCurrentLocation();
    } else if (!useCurrentLocation) {
      setLocation(null);
    }
  }, [useCurrentLocation]);

  const fetchCurrentLocation = async () => {
    try {
      const coords = await getCurrentLocation();
      setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('エラー', '現在地を取得できませんでした');
      setUseCurrentLocation(false);
    }
  };
  
  const handleCategoryToggle = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
    } else {
      if (selectedCategories.length < 3) {
        setSelectedCategories([...selectedCategories, categoryId]);
      } else {
        Alert.alert('注意', 'カテゴリーは最大3つまで選択できます');
      }
    }
  };
  
  const handlePrefectureSelect = (selectedPrefectureId: string, selectedCityId?: string) => {
    setPrefectureId(selectedPrefectureId);
    if (selectedCityId) {
      setCityId(selectedCityId);
    } else {
      setCityId('');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setTime(selectedTime);
    }
  };
  
  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!title.trim()) {
      newErrors.title = 'イベントタイトルを入力してください';
    }

    if (!description.trim()) {
      newErrors.description = 'イベント詳細を入力してください';
    }

    if (!prefectureId && !locationName.trim()) {
      newErrors.location = '開催場所を入力するか、都道府県を選択してください';
    }

    if (selectedCategories.length === 0) {
      newErrors.categories = 'ジャンルを1つ以上選択してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validateForm()) {
      return;
    }
    
    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    try {
      setIsLoading(true);

      // 開始日時の設定（日付と時間を組み合わせる）
      const startDateTime = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        time.getHours(),
        time.getMinutes(),
        0,
        0
      );

      // 日付のバリデーション
      if (isNaN(startDateTime.getTime())) {
        Alert.alert('エラー', '無効な日付または時間が指定されています');
        setIsLoading(false);
        return;
      }

      // デバッグ用
      console.log('保存する日時:', startDateTime);
      console.log('日時のタイムスタンプ:', startDateTime.getTime());

      // イベントデータの更新
      const eventData = {
        title,
        description,
        locationName,
        location,
        startDate: firestore.Timestamp.fromDate(startDateTime),
        maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : null,
        requiresApproval,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        categories: selectedCategories.length > 0 ? selectedCategories : null,
        prefecture: prefectureId || null,
        city: cityId || null,
      };

      await firestore().collection('events').doc(eventId).update(eventData);

      Alert.alert('完了', 'イベントを更新しました', [
        { text: 'OK', onPress: () => navigation.navigate('EventDetails', { eventId }) }
      ]);
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('エラー', 'イベントの更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>イベント情報を読み込み中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.label}>イベント名</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="イベント名を入力"
          placeholderTextColor={theme.colors.text.disabled}
        />
        {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

        <Text style={styles.label}>説明</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="イベントの説明を入力"
          placeholderTextColor={theme.colors.text.disabled}
          multiline
          numberOfLines={4}
        />
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
        
        <Text style={styles.label}>ジャンル (最大3つ)</Text>
        <View style={styles.categoriesContainer}>
          {CATEGORIES.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategories.includes(category.id) && styles.selectedCategoryChip,
              ]}
              onPress={() => handleCategoryToggle(category.id)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategories.includes(category.id) && styles.selectedCategoryChipText,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.categories && <Text style={styles.errorText}>{errors.categories}</Text>}
        {selectedCategories.length > 0 && (
          <Text style={styles.selectedCategoriesText}>
            選択中: {selectedCategories.map(id => CATEGORIES.find(c => c.id === id)?.name).join(', ')}
          </Text>
        )}

        <Text style={styles.label}>開催日</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.datePickerButtonText}>
            {date.toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        <Text style={styles.label}>開始時間</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowTimePicker(true)}
        >
          <Text style={styles.datePickerButtonText}>
            {time.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </TouchableOpacity>
        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )}

        <Text style={styles.label}>開催地域</Text>
        <TouchableOpacity
          style={styles.prefectureSelector}
          onPress={() => setShowPrefectureSelector(true)}
        >
          <Text style={prefectureId ? styles.prefectureText : styles.placeholderText}>
            {prefectureId ? getLocationString(prefectureId, cityId) : '都道府県を選択'}
          </Text>
          <Icon name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
        {errors.prefecture && <Text style={styles.errorText}>{errors.prefecture}</Text>}

        <Text style={styles.label}>会場名</Text>
        <TextInput
          style={styles.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="会場名を入力"
          placeholderTextColor={theme.colors.text.disabled}
        />
        {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}

        <View style={styles.switchContainer}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>現在地を使用</Text>
            <Text style={styles.switchDescription}>
              現在の位置情報をイベント開催場所として設定します
            </Text>
          </View>
          <Switch
            value={useCurrentLocation}
            onValueChange={setUseCurrentLocation}
            trackColor={{ false: '#767577', true: `${theme.colors.primary}50` }}
            thumbColor={useCurrentLocation ? theme.colors.primary : '#f4f3f4'}
          />
        </View>

        <Text style={styles.label}>参加人数上限（任意）</Text>
        <TextInput
          style={styles.input}
          value={maxParticipants}
          onChangeText={setMaxParticipants}
          placeholder="参加人数上限を入力"
          placeholderTextColor={theme.colors.text.disabled}
          keyboardType="number-pad"
        />

        <View style={styles.switchContainer}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>参加承認制</Text>
            <Text style={styles.switchDescription}>
              参加者を承認する必要があります
            </Text>
          </View>
          <Switch
            value={requiresApproval}
            onValueChange={setRequiresApproval}
            trackColor={{ false: '#767577', true: `${theme.colors.primary}50` }}
            thumbColor={requiresApproval ? theme.colors.primary : '#f4f3f4'}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.updateButton,
            isLoading && styles.disabledButton,
          ]}
          onPress={handleUpdate}
          disabled={isLoading}
        >
          <Text style={styles.updateButtonText}>
            {isLoading ? '更新中...' : '更新する'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <PrefectureSelector
        visible={showPrefectureSelector}
        onClose={() => setShowPrefectureSelector(false)}
        onSelect={handlePrefectureSelect}
        initialPrefectureId={prefectureId}
        initialCityId={cityId}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  formContainer: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    paddingVertical: 5,
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  switchDescription: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  updateButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
    backgroundColor: '#f8f8f8',
  },
  selectedCategoryChip: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  selectedCategoryChipText: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  selectedCategoriesText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 12,
  },
  prefectureSelector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  prefectureText: {
    fontSize: 16,
    color: '#000',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginTop: -8,
    marginBottom: 12,
  },
});

export default EditEventScreen; 