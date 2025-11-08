import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { PREFECTURES, Prefecture, City } from '../utils/prefectureData';
import { theme } from '../styles/theme';

interface PrefectureSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (prefectureId: string, cityId?: string) => void;
  initialPrefectureId?: string;
  initialCityId?: string;
  showCities?: boolean;
}

const PrefectureSelector: React.FC<PrefectureSelectorProps> = ({
  visible,
  onClose,
  onSelect,
  initialPrefectureId,
  initialCityId,
  showCities = true,
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedPrefecture, setSelectedPrefecture] = useState<Prefecture | null>(null);
  const [filteredPrefectures, setFilteredPrefectures] = useState(PREFECTURES);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [showingCities, setShowingCities] = useState(false);

  useEffect(() => {
    if (initialPrefectureId) {
      const prefecture = PREFECTURES.find(p => p.id === initialPrefectureId);
      if (prefecture) {
        setSelectedPrefecture(prefecture);
        if (showCities) {
          setShowingCities(true);
          setFilteredCities(prefecture.cities);
        }
      }
    }
  }, [initialPrefectureId, showCities]);

  useEffect(() => {
    if (searchText) {
      const filtered = PREFECTURES.filter(prefecture => 
        prefecture.name.includes(searchText)
      );
      setFilteredPrefectures(filtered);
      
      if (selectedPrefecture) {
        const filteredCities = selectedPrefecture.cities.filter(city => 
          city.name.includes(searchText)
        );
        setFilteredCities(filteredCities);
      }
    } else {
      setFilteredPrefectures(PREFECTURES);
      if (selectedPrefecture) {
        setFilteredCities(selectedPrefecture.cities);
      }
    }
  }, [searchText, selectedPrefecture]);

  const handlePrefectureSelect = (prefecture: Prefecture) => {
    setSelectedPrefecture(prefecture);
    setFilteredCities(prefecture.cities);
    
    if (!showCities) {
      onSelect(prefecture.id);
      onClose();
    } else {
      setShowingCities(true);
    }
  };

  const handleCitySelect = (city: City) => {
    if (selectedPrefecture) {
      onSelect(selectedPrefecture.id, city.id);
      onClose();
    }
  };

  const handleBackToPrefectures = () => {
    setShowingCities(false);
    setSearchText('');
  };

  const renderPrefectureItem = ({ item }: { item: Prefecture }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => handlePrefectureSelect(item)}
    >
      <Text style={styles.itemText}>{item.name}</Text>
      <Icon name="chevron-forward" size={20} color={theme.colors.text.secondary} />
    </TouchableOpacity>
  );

  const renderCityItem = ({ item }: { item: City }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => handleCitySelect(item)}
    >
      <Text style={styles.itemText}>{item.name}</Text>
      <Icon name="chevron-forward" size={20} color={theme.colors.text.secondary} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={showingCities ? handleBackToPrefectures : onClose} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {showingCities ? selectedPrefecture?.name || '都道府県' : '都道府県を選択'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>閉じる</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={theme.colors.text.secondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={showingCities ? "市区町村を検索" : "都道府県を検索"}
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor={theme.colors.text.secondary}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
              <Icon name="close-circle" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {!showingCities ? (
          <FlatList
            data={filteredPrefectures}
            renderItem={renderPrefectureItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <FlatList
            data={filteredCities}
            renderItem={renderCityItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: theme.colors.primary,
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: theme.colors.text.primary,
  },
  clearButton: {
    padding: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
});

export default PrefectureSelector;
